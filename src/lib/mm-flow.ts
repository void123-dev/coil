import type { MmEvent, SymbolId } from "../coil/types.ts"
import { cached } from "./cache.ts"
import { hash32 } from "./venues/demo.ts"
import { SYMBOLS } from "../coil/types.ts"

export type MmFlowState = {
  status: "disabled" | "demo" | "live" | "empty"
  events: MmEvent[]
}

function demoEvents(now = Date.now()): MmEvent[] {
  return SYMBOLS.slice(0, 4).map((asset, i) => {
    const h = hash32(`mm:${asset}`)
    const side: MmEvent["side"] = h % 2 === 0 ? "cex_deposit" : "cex_withdrawal"
    return {
      t: now - (20 + i * 17) * 60_000,
      entity: "demo-inventory",
      asset,
      side,
      usd: 750_000 + (h % 12) * 180_000,
      source: "demo" as const,
    }
  })
}

function parseEvents(data: unknown): MmEvent[] {
  const list = Array.isArray(data) ? data
    : data && typeof data === "object" && Array.isArray((data as { events?: unknown }).events)
      ? (data as { events: unknown[] }).events
      : []
  const out: MmEvent[] = []
  for (const row of list) {
    if (!row || typeof row !== "object") continue
    const r = row as Record<string, unknown>
    const t = typeof r.t === "number" ? r.t : Number(r.t)
    const usd = typeof r.usd === "number" ? r.usd : Number(r.usd)
    const asset = typeof r.asset === "string" ? r.asset : ""
    if (!Number.isFinite(t) || !Number.isFinite(usd) || !asset) continue
    const side = r.side
    const okSide =
      side === "cex_deposit" || side === "cex_withdrawal" || side === "dex_buy"
      || side === "dex_sell" || side === "perp_open" || side === "unknown"
    const src = r.source
    const okSrc = src === "demo" || src === "manual" || src === "arkham" || src === "lens" || src === "custom"
    out.push({
      t,
      entity: typeof r.entity === "string" ? r.entity : "unknown",
      asset: asset as SymbolId | string,
      side: okSide ? side : "unknown",
      usd,
      source: okSrc ? src : "custom",
    })
  }
  return out
}

async function loadMmFlow(): Promise<MmFlowState> {
  const src = (process.env.MM_FLOW_SOURCE ?? "off").toLowerCase()
  if (src === "off" || src === "") return { status: "disabled", events: [] }
  if (src === "demo") return { status: "demo", events: demoEvents() }
  if (src === "url") {
    const url = process.env.MM_FLOW_URL
    if (!url) return { status: "empty", events: [] }
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(4000),
        headers: { Accept: "application/json", "User-Agent": "COIL-1.0" },
      })
      if (!res.ok) return { status: "empty", events: [] }
      const events = parseEvents(await res.json())
      return { status: events.length ? "live" : "empty", events }
    } catch {
      return { status: "empty", events: [] }
    }
  }
  return { status: "disabled", events: [] }
}

export async function fetchMmFlow(): Promise<MmFlowState> {
  return cached("mm-flow", loadMmFlow)
}
