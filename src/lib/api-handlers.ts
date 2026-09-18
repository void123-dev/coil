import { emptyDeskCard, exportEnvelope, parseQuery } from "../coil/schema.ts"
import { getBreadth, getCoilSnapshot, getDeskCard, getVenuesPayload, parseCoilQuery } from "./coil-service.ts"
import { EXPORT_SCHEMA, snapshotToCsv } from "./export-format.ts"
import { jsonResponse, optionsResponse, textResponse } from "./http.ts"

export { optionsResponse }

export async function handleCoil(request: Request) {
  const url = new URL(request.url)
  try {
    const query = await parseCoilQuery(url)
    return jsonResponse(await getCoilSnapshot(query), { request })
  } catch {
    return jsonResponse({ error: "unavailable", snapshot: emptyDeskCard(parseQuery(url)) }, { request })
  }
}

export async function handleDesk(request: Request) {
  const url = new URL(request.url)
  try {
    const query = await parseCoilQuery(url)
    return jsonResponse(await getDeskCard(query), { request })
  } catch {
    return jsonResponse(emptyDeskCard(parseQuery(url)), { request })
  }
}

export async function handleBreadth(request: Request) {
  const url = new URL(request.url)
  try {
    const query = await parseCoilQuery(url)
    return jsonResponse(await getBreadth(query), { request })
  } catch {
    return jsonResponse({ asOf: Date.now(), items: [], venue: null, interval: parseQuery(url).interval, window: parseQuery(url).window }, { request })
  }
}

export async function handleVenues(request: Request) {
  const url = new URL(request.url)
  try {
    const query = parseQuery(url)
    return jsonResponse(await getVenuesPayload(query), { request })
  } catch {
    return jsonResponse({
      pits: [],
      default: { venue: "okx", interval: "5m" },
    }, { request })
  }
}

export async function handleExport(request: Request) {
  const url = new URL(request.url)
  const raw = parseQuery(url)
  try {
    const query = await parseCoilQuery(url)
    if (query.format === "schema") {
      return jsonResponse(EXPORT_SCHEMA, { request })
    }
    const snapshot = await getCoilSnapshot(query)
    const filename = query.download
      ? `coil-${query.symbol}-${query.interval}.${query.format === "csv" ? "csv" : "json"}`
      : undefined
    const disposition = filename ? { "Content-Disposition": `attachment; filename="${filename}"` } : undefined
    if (query.format === "csv") {
      return textResponse(snapshotToCsv(snapshot), "text/csv; charset=utf-8", disposition, request)
    }
    return jsonResponse(exportEnvelope(query, snapshot), { headers: disposition, request })
  } catch {
    const card = emptyDeskCard(raw)
    return jsonResponse({
      api: "coil-export",
      ...card,
      card,
      snapshot: card,
    }, { request })
  }
}
