import type { ReactNode } from "react"
import type { CoilSnapshot, SessionLabel } from "@/coil/types.ts"
import { sessionAt } from "@/coil/session.ts"
import { COPY, type Lang } from "./copy.ts"
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

const AXIS = { fontSize: 10, fill: "var(--color-subtle)", fontFamily: "var(--font-mono)" }
const GRID = { stroke: "var(--color-border)", strokeDasharray: "2 4" }
const TIP = {
  contentStyle: {
    background: "var(--color-elevated)",
    border: "1px solid var(--color-border)",
    borderRadius: 10,
    fontSize: 12,
    color: "var(--color-fg)",
  },
  labelStyle: { color: "var(--color-muted)" },
}

function tickTime(t: number) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(t))
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-3 text-xs font-medium tracking-wide text-muted">{title}</h3>
      <div className="h-44 w-full">{children}</div>
    </section>
  )
}

export function CoilCharts({
  snap,
  lang,
}: {
  snap: CoilSnapshot
  lang: Lang
}) {
  const copy = COPY[lang]
  const rows = snap.series.map((row) => {
    const s0 = snap.series[0]?.spot || 1
    const p0 = snap.series[0]?.perp || 1
    return {
      ...row,
      spotIdx: (row.spot / s0) * 100,
      perpIdx: (row.perp / p0) * 100,
      session: sessionAt(row.t).label,
    }
  })

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Panel title={copy.charts.scoreBias}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="t" tickFormatter={tickTime} tick={AXIS} minTickGap={28} />
            <YAxis yAxisId="s" domain={[0, 100]} tick={AXIS} width={32} />
            <YAxis yAxisId="b" orientation="right" domain={[-1, 1]} tick={AXIS} width={32} />
            <Tooltip {...TIP} labelFormatter={(v) => tickTime(Number(v))} />
            <Line yAxisId="s" type="monotone" dataKey="score" stroke="var(--color-fg)" dot={false} strokeWidth={1.5} isAnimationActive={false} name="score" />
            <Line yAxisId="b" type="monotone" dataKey="bias" stroke="var(--color-accent)" dot={false} strokeWidth={1.5} isAnimationActive={false} name="bias" />
          </ComposedChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title={copy.charts.fundingPrice}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="t" tickFormatter={tickTime} tick={AXIS} minTickGap={28} />
            <YAxis yAxisId="p" tick={AXIS} width={44} tickFormatter={(v) => Number(v).toFixed(0)} />
            <YAxis yAxisId="f" orientation="right" tick={AXIS} width={44} tickFormatter={(v) => `${(Number(v) * 100).toFixed(3)}%`} />
            <Tooltip {...TIP} labelFormatter={(v) => tickTime(Number(v))} />
            <Line yAxisId="p" type="monotone" dataKey="spot" stroke="var(--color-accent)" dot={false} strokeWidth={1.5} isAnimationActive={false} name="spot" />
            <Line yAxisId="f" type="monotone" dataKey="funding" stroke="var(--color-watch)" dot={false} strokeWidth={1.5} isAnimationActive={false} name="funding" />
          </ComposedChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title={copy.charts.oiPrice}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="t" tickFormatter={tickTime} tick={AXIS} minTickGap={28} />
            <YAxis yAxisId="p" tick={AXIS} width={44} tickFormatter={(v) => Number(v).toFixed(0)} />
            <YAxis yAxisId="o" orientation="right" tick={AXIS} width={44} tickFormatter={(v) => `${(Number(v) / 1e9).toFixed(2)}B`} />
            <Tooltip {...TIP} labelFormatter={(v) => tickTime(Number(v))} />
            <Line yAxisId="p" type="monotone" dataKey="spot" stroke="var(--color-accent)" dot={false} strokeWidth={1.5} isAnimationActive={false} name="spot" />
            <Area yAxisId="o" type="monotone" dataKey="oiUsd" stroke="var(--color-live)" fill="var(--color-live)" fillOpacity={0.15} isAnimationActive={false} name="oi" />
          </ComposedChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title={copy.charts.activity}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="t" tickFormatter={tickTime} tick={AXIS} minTickGap={28} />
            <YAxis tick={AXIS} width={36} domain={["auto", "auto"]} />
            <Tooltip {...TIP} labelFormatter={(v) => tickTime(Number(v))} />
            <Line type="monotone" dataKey="spotIdx" stroke="var(--color-accent)" dot={false} strokeWidth={1.5} isAnimationActive={false} name="spot" />
            <Line type="monotone" dataKey="perpIdx" stroke="var(--color-live)" dot={false} strokeWidth={1.5} isAnimationActive={false} name="perp" />
          </ComposedChart>
        </ResponsiveContainer>
      </Panel>

      <SessionStrip rows={rows} title={copy.charts.session} />
    </div>
  )
}

const SESSION_TONE: Record<SessionLabel, string> = {
  asia_open: "bg-elevated",
  asia: "bg-elevated",
  london_open: "bg-accent/30",
  london: "bg-accent/20",
  ny_open: "bg-live/35",
  ny: "bg-live/25",
  ny_close: "bg-watch/30",
  weekend: "bg-armed/25",
}

function SessionStrip({
  rows,
  title,
}: {
  rows: Array<{ t: number; session: SessionLabel }>
  title: string
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4 md:col-span-2">
      <h3 className="mb-3 text-xs font-medium tracking-wide text-muted">{title}</h3>
      <div className="flex h-10 overflow-hidden rounded-md">
        {rows.map((row) => (
          <div
            key={row.t}
            className={`min-w-0 flex-1 ${SESSION_TONE[row.session]}`}
            title={`${row.session} · ${tickTime(row.t)}`}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] uppercase tracking-wider text-subtle">
        <span>asia</span>
        <span>london</span>
        <span>ny</span>
        <span>ny close</span>
        <span>weekend</span>
      </div>
    </section>
  )
}
