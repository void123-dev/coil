import type { SessionLabel } from "./types.ts"

export function sessionAt(ms: number, timeZone = "America/New_York"): { label: SessionLabel; etHour: number; thin: boolean } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, weekday: "short", hour: "numeric", hourCycle: "h23",
  }).formatToParts(new Date(ms))
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? ""
  const etHour = Number(parts.find((p) => p.type === "hour")?.value ?? 0)
  if (weekday === "Sat" || weekday === "Sun") return { label: "weekend", etHour, thin: true }
  let label: SessionLabel
  if (etHour >= 19) label = "asia_open"
  else if (etHour < 3) label = "asia"
  else if (etHour < 5) label = "london_open"
  else if (etHour < 8) label = "london"
  else if (etHour < 10) label = "ny_open"
  else if (etHour < 16) label = "ny"
  else label = "ny_close"
  const thin = label === "ny_close" || label === "asia_open"
  return { label, etHour, thin }
}

export function sessionTag(label: SessionLabel | string | null | undefined): string | null {
  if (!label) return null
  if (label === "weekend") return "weekend"
  if (label === "asia" || label === "asia_open") return "asia"
  if (label === "london" || label === "london_open") return "london"
  if (label === "ny" || label === "ny_open" || label === "ny_close" || label === "us") return "us"
  return typeof label === "string" && label.length ? label : null
}
